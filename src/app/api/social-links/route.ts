import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth-helpers';
import SocialLinks from '../../../../src/models/SocialLinks';

const sanitizeString = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({
        socialLinks: {
          facebookUrl: '',
          twitterUrl: '',
          youtubeUrl: '',
          googlePlusUrl: '',
          linkedinUrl: '',
          instagramUrl: '',
          yelpUrl: '',
        },
      });
    }

    const socialLinksDoc = await SocialLinks.findOne({ company: currentUser.company });

    const socialLinks = {
      facebookUrl: socialLinksDoc?.facebookUrl || '',
      twitterUrl: socialLinksDoc?.twitterUrl || '',
      youtubeUrl: socialLinksDoc?.youtubeUrl || '',
      googlePlusUrl: socialLinksDoc?.googlePlusUrl || '',
      linkedinUrl: socialLinksDoc?.linkedinUrl || '',
      instagramUrl: socialLinksDoc?.instagramUrl || '',
      yelpUrl: socialLinksDoc?.yelpUrl || '',
    };

    return NextResponse.json({ socialLinks });
  } catch (error: any) {
    console.error('Social Links GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load social links' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'Company not found. Please create a company profile first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { socialLinks } = body ?? {};

    if (!socialLinks) {
      return NextResponse.json(
        { error: 'Invalid payload: socialLinks data is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | undefined> = {
      facebookUrl: sanitizeString(socialLinks.facebookUrl),
      twitterUrl: sanitizeString(socialLinks.twitterUrl),
      youtubeUrl: sanitizeString(socialLinks.youtubeUrl),
      googlePlusUrl: sanitizeString(socialLinks.googlePlusUrl),
      linkedinUrl: sanitizeString(socialLinks.linkedinUrl),
      instagramUrl: sanitizeString(socialLinks.instagramUrl),
      yelpUrl: sanitizeString(socialLinks.yelpUrl),
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Use findOneAndUpdate with upsert to create or update
    const updatedSocialLinks = await SocialLinks.findOneAndUpdate(
      { company: currentUser.company },
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    );

    if (!updatedSocialLinks) {
      return NextResponse.json(
        { error: 'Failed to update social links' },
        { status: 500 }
      );
    }

    const responseSocialLinks = {
      facebookUrl: updatedSocialLinks.facebookUrl || '',
      twitterUrl: updatedSocialLinks.twitterUrl || '',
      youtubeUrl: updatedSocialLinks.youtubeUrl || '',
      googlePlusUrl: updatedSocialLinks.googlePlusUrl || '',
      linkedinUrl: updatedSocialLinks.linkedinUrl || '',
      instagramUrl: updatedSocialLinks.instagramUrl || '',
      yelpUrl: updatedSocialLinks.yelpUrl || '',
    };

    return NextResponse.json({
      message: 'Social links updated successfully',
      socialLinks: responseSocialLinks,
    });
  } catch (error: any) {
    console.error('Social Links PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update social links' },
      { status: 500 }
    );
  }
}

